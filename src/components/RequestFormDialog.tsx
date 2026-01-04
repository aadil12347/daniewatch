import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRequests } from "@/hooks/useRequests";
import { useToast } from "@/hooks/use-toast";

const requestSchema = z.object({
  request_type: z.enum(['movie', 'tv_season', 'general']),
  title: z.string().min(1, 'Title is required'),
  season_number: z.number().optional(),
  message: z.string().min(10, 'Please provide at least 10 characters'),
});

type RequestFormValues = z.infer<typeof requestSchema>;

interface RequestFormDialogProps {
  defaultTitle?: string;
  defaultType?: 'movie' | 'tv';
  defaultSeason?: number;
  onSuccess?: () => void;
}

export const RequestFormDialog = ({
  defaultTitle = '',
  defaultType,
  defaultSeason,
  onSuccess,
}: RequestFormDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { createRequest } = useRequests();
  const { toast } = useToast();
  const navigate = useNavigate();

  const form = useForm<RequestFormValues>({
    resolver: zodResolver(requestSchema),
    defaultValues: {
      request_type: defaultType === 'tv' ? 'tv_season' : defaultType === 'movie' ? 'movie' : 'general',
      title: defaultTitle,
      season_number: defaultSeason,
      message: '',
    },
  });

  const requestType = form.watch('request_type');

  // Update form when defaults change
  useEffect(() => {
    if (defaultTitle) {
      form.setValue('title', defaultTitle);
    }
    if (defaultType) {
      form.setValue('request_type', defaultType === 'tv' ? 'tv_season' : 'movie');
    }
    if (defaultSeason) {
      form.setValue('season_number', defaultSeason);
    }
  }, [defaultTitle, defaultType, defaultSeason, form]);

  const onSubmit = async (data: RequestFormValues) => {
    setIsSubmitting(true);
    
    const { error } = await createRequest({
      request_type: data.request_type,
      title: data.title,
      season_number: data.request_type === 'tv_season' ? data.season_number : undefined,
      message: data.message,
    });

    setIsSubmitting(false);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to submit request. Please try again.",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Request Submitted!",
        description: "We'll review your request and get back to you soon.",
        onClick: () => navigate('/requests'),
      });
      form.reset();
      onSuccess?.();
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="request_type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Request Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="movie">Movie</SelectItem>
                  <SelectItem value="tv_season">TV Season</SelectItem>
                  <SelectItem value="general">General Request</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input 
                  placeholder="Movie or TV show name" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {requestType === 'tv_season' && (
          <FormField
            control={form.control}
            name="season_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Season Number</FormLabel>
                <FormControl>
                  <Input 
                    type="number"
                    min={1}
                    placeholder="e.g., 3"
                    {...field}
                    onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                    value={field.value || ''}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Message</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Please describe what you need..."
                  className="min-h-[100px]"
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            'Submit Request'
          )}
        </Button>
      </form>
    </Form>
  );
};
